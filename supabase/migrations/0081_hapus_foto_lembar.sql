-- ============================================================================
-- hrcd-rekap : 0081_hapus_foto_lembar.sql
--
-- MENGHAPUS SATU FOTO SLIP, DENGAN ALASAN YANG TERCATAT.
--
-- ---------------------------------------------------------------------------
-- KENAPA PERLU
--
-- Sampai sekarang foto hanya bisa DITAMBAH. Slip yang terfoto buram, terbalik,
-- salah regu, atau terlanjur diunggah ke lomba yang keliru menumpuk di dialog
-- Foto Jawaban selamanya — dan tumpukan itu justru mengaburkan bukti yang
-- benar, karena yang membuka dialog harus menebak mana yang berlaku.
--
-- ---------------------------------------------------------------------------
-- KENAPA PAKAI ALASAN
--
-- Foto slip adalah BUKTI. Ia dipanggil justru ketika sebuah nilai
-- dipertanyakan, jadi menghapusnya menghapus kemampuan menjawab pertanyaan itu
-- — dan tidak ada satu pun galat yang muncul saat bukti hilang.
--
-- Polanya disalin dari `buka_kunci_nilai_pos` (0045), beserta pelajarannya:
-- alasannya dicatat SEBELUM barisnya hilang. Dicatat sesudah, ia hilang
-- bersama barisnya dan yang tersisa cuma foto yang tidak ada lagi tanpa
-- keterangan.
--
-- DUA BARIS history, dan itu memang dimaksud. Trigger `audit_foto_lembar`
-- (0074) sudah merekam DELETE-nya sendiri — APA yang hilang, lengkap dengan
-- path dan nama lombanya. Baris yang ditulis fungsi ini menyimpan KENAPA.
-- Menggabungkan keduanya berarti menulis ulang trigger 0074; membiarkan
-- triggernya bekerja dan menambah satu baris beralasan jauh lebih murah, dan
-- keduanya menunjuk `row_id` yang sama sehingga tetap bisa dipasangkan.
--
-- ---------------------------------------------------------------------------
-- PAGARNYA SAMA DENGAN YANG MENGUNGGAH
--
-- Siapa yang boleh menaruh foto di sebuah pos, boleh pula mengangkatnya dari
-- sana. `boleh('pos')` beserta isolasi `pos_saya()` — persis syarat
-- `catat_foto_masuk`. Koordinator pos (`pos_saya()` NULL) menjangkau kelima
-- pos, seperti di tempat lain.
--
-- ---------------------------------------------------------------------------
-- BERKASNYA DI STORAGE
--
-- Menghapus baris TIDAK menghapus gambarnya — SQL tidak menjangkau bucket.
-- Fungsi ini karena itu MENGEMBALIKAN path-nya, supaya yang memanggil bisa
-- menghapus objeknya sesudah barisnya benar-benar hilang.
--
-- Urutannya begitu, bukan sebaliknya. Kalau objeknya dihapus lebih dulu lalu
-- penghapusan barisnya gagal, yang tersisa adalah baris yang menunjuk gambar
-- yang tidak ada — dialog Foto Jawaban menggambar kotak rusak, dan tidak ada
-- yang bisa membetulkannya dari layar. Kebalikannya cuma menyisakan berkas
-- yatim: tidak terlihat siapa pun, dan bisa disapu belakangan.
--
-- Policy `delete` untuk bucketnya dipasang di bawah — sampai sekarang bucket
-- `lembar` hanya punya policy `select` dan `insert` (0047, diperbarui 0064),
-- jadi tanpa ini objeknya akan menolak dihapus tanpa menyebut sebabnya.
-- ============================================================================

create or replace function hapus_foto_lembar(
  p_id     uuid,
  p_alasan text
) returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_pos   smallint;
  v_path  text;
  v_regu  uuid;
  v_lomba text;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;

  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan menghapus foto wajib diisi';
  end if;

  select pos, path, regu_id, nama_lomba
    into v_pos, v_path, v_regu, v_lomba
  from foto_lembar where id = p_id;

  if not found then
    raise exception 'foto tidak dikenal';
  end if;

  if pos_saya() is not null and v_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh menghapus foto pos %',
      pos_saya(), v_pos;
  end if;

  -- Alasannya dicatat SEBELUM barisnya hilang (pelajaran 0045).
  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('foto_lembar', p_id::text, v_regu, 'DELETE',
          jsonb_build_object('alasan_hapus_foto', p_alasan,
                             'pos', v_pos, 'nama_lomba', v_lomba,
                             'path', v_path),
          auth.uid());

  delete from foto_lembar where id = p_id;

  -- Path dikembalikan supaya pemanggil bisa menghapus objeknya di bucket.
  return v_path;
end;
$$;

comment on function hapus_foto_lembar(uuid, text) is
  'Hapus satu foto slip beserta alasannya. Mengembalikan path-nya supaya '
  'objek di bucket ikut dihapus pemanggil — SQL tidak menjangkau storage.';

grant execute on function hapus_foto_lembar(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Policy hapus untuk bucket `lembar`.
--
-- Syaratnya sama persis dengan `foto_lembar_tulis` (0064): yang boleh menaruh,
-- boleh pula mengangkat. Dibungkus pemeriksaan skema seperti 0064 — di
-- database uji skema `storage` tidak ada, dan migrasi yang gagal di sana
-- berarti berkas ini berhenti diuji sama sekali (CLAUDE.md 7.5).
-- ---------------------------------------------------------------------------
do $blok$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'objects') then
    execute $p$
      drop policy if exists foto_lembar_hapus on storage.objects;
      $p$;
    execute $p$
      create policy foto_lembar_hapus on storage.objects for delete
      using (
        bucket_id = 'lembar' and (
          boleh('rekap')
          or (boleh('pos') and (
                pos_saya() is null
                or split_part(name, '/', 1) = 'pos' || pos_saya()::text))
        )
      )
      $p$;
    raise notice '0081: policy hapus storage foto lembar terpasang.';
  else
    raise notice '0081: skema storage tidak ada — policy hapusnya dilewati.';
  end if;
end $blok$;
