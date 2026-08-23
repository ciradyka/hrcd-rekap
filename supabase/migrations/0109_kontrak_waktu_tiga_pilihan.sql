-- ============================================================================
-- hrcd-rekap : 0109_kontrak_waktu_tiga_pilihan.sql
-- Pilihan kontrak waktu jadi 3 jam, 3,5 jam, dan 4 jam.
--
-- Sebelumnya 3,5 / 4 / 4,5 jam. Seluruh tangganya turun setengah jam:
-- keputusan pemilik acara, bukan penyesuaian teknis.
--
-- ---------------------------------------------------------------------------
-- KENAPA BUKAN SEKADAR UPDATE TIGA BARIS
--
-- `kontrak_opsi` berkunci PRIMARY KEY (edisi, menit), jadi yang berubah bukan
-- label melainkan HIMPUNANNYA: 180 lahir, 270 pergi, 210 dan 240 bertahan
-- dengan urutan baru. Menulisnya sebagai tiga UPDATE akan menabrak kunci itu
-- di baris pertama.
--
-- ---------------------------------------------------------------------------
-- PAGAR YANG MENAHAN KEHILANGAN DIAM-DIAM
--
-- Kalau ada regu yang kontraknya sudah tercatat 270 menit, membuang barisnya
-- dari `kontrak_opsi` TIDAK menghapus kontrak regu itu — dan justru itu
-- masalahnya. Layar Keberangkatan menggambar dropdown-nya dari
-- `kontrak_opsi`, lalu menandai `selected` pada opsi yang cocok:
--
--     ${opsi.map(o => `<option ... ${r.kontrak_menit === o.menit ? "selected" : ""}>`)}
--
-- Tanpa baris 270, tidak ada yang cocok, dan dropdown-nya jatuh ke "Belum
-- dipilih" — untuk regu yang SUDAH berkontrak. Petugas membaca "belum",
-- sistem menyimpan 270, dan penaltinya dihitung dari angka yang tidak
-- tertulis di mana pun di layar. Peringatan "sudah diceklis tapi belum punya
-- kontrak" pun tidak menyalak, karena ia memeriksa `kontrak_menit === null`.
--
-- Karena itu migrasi ini BERHENTI kalau ada regu yang masih memegang menit
-- yang akan hilang, dan menyebutkan nomor dadanya. Yang harus memutuskan apa
-- yang terjadi pada regu itu adalah panitia, bukan berkas ini.
-- ============================================================================

do $blok$
declare
  v_edisi  smallint := edisi_aktif();
  v_baru   smallint[] := array[180, 210, 240];
  v_yatim  text;
  v_lama   text;
begin
  if v_edisi is null then
    raise notice '0109: belum ada edisi aktif — pilihan kontrak dilewati.';
    return;
  end if;

  -- Trigger `kunci_kontrak_opsi` akan menolak setiap tulisan di bawah, tapi
  -- pesannya menyebut layar Konfigurasi dan bukan berkas ini. Ditangkap lebih
  -- dulu supaya yang menjalankannya tahu apa yang harus dibuka.
  if (select konfigurasi_terkunci from status_acara) then
    raise exception '0109: konfigurasi sedang terkunci — buka kuncinya di '
      'status_acara dulu, lalu jalankan ulang migrasi ini.';
  end if;

  select string_agg(format('%s (%s menit)', dada3.nomor_dada, dada3.kontrak_menit),
                    ', ' order by dada3.nomor_dada)
    into v_yatim
  from (select r.nomor_dada, r.kontrak_menit from regu r
        where not r.is_cancelled
          and r.kontrak_menit is not null
          and not (r.kontrak_menit = any (v_baru))) dada3;

  if v_yatim is not null then
    raise exception '0109: regu berikut memegang kontrak yang akan dihapus: %. '
      'Membuang pilihannya membuat dropdown Keberangkatan berbunyi "Belum '
      'dipilih" untuk regu yang SUDAH berkontrak, sementara penaltinya tetap '
      'dihitung dari angka lama. Betulkan kontrak regu itu dulu, baru '
      'jalankan ulang migrasi ini.', v_yatim;
  end if;

  select string_agg(format('%s=%s', label, menit), ', ' order by sort_order)
    into v_lama
  from kontrak_opsi where edisi = v_edisi;

  delete from kontrak_opsi
  where edisi = v_edisi and not (menit = any (v_baru));

  insert into kontrak_opsi (edisi, label, menit, sort_order) values
    (v_edisi, '3 jam',   180, 1),
    (v_edisi, '3,5 jam', 210, 2),
    (v_edisi, '4 jam',   240, 3)
  on conflict (edisi, menit) do update set
    label      = excluded.label,
    sort_order = excluded.sort_order;

  raise notice '0109: kontrak edisi % — dari [%] jadi [3 jam=180, 3,5 jam=210, 4 jam=240].',
               v_edisi, coalesce(v_lama, 'kosong');
end;
$blok$;

do $blok$
declare
  v_edisi smallint := edisi_aktif();
  v_isi   text;
begin
  if v_edisi is null then return; end if;

  select string_agg(format('%s=%s', label, menit), ', ' order by sort_order)
    into v_isi
  from kontrak_opsi where edisi = v_edisi;

  assert v_isi = '3 jam=180, 3,5 jam=210, 4 jam=240',
    format('0109: pilihan kontrak edisi %s belum sesuai — sekarang [%s]',
           v_edisi, coalesce(v_isi, 'kosong'));
end;
$blok$;
