-- ============================================================================
-- hrcd-rekap : tests/sql/38_koordinator_pos.sql
-- Peran kelima: koordinator_pos (migrasi 0075).
--
-- YANG DIJAGA, DAN KENAPA MASING-MASING
--
-- Peran ini tidak menambah satu policy pun — seluruh gunanya bertumpu pada
-- satu hal: kolom `pos`-nya KOSONG, sehingga `pos_saya()` NULL, sehingga pagar
-- `pos_saya() is null or pos = pos_saya()` membuka semuanya.
--
-- Rantai itu panjang dan tidak satu pun matanya kelihatan dari layar. Kalau
-- suatu hari ada yang "merapikan" pagar itu jadi perbandingan langsung, atau
-- membuang check dua arah dari 0058 supaya koordinator "boleh punya pos
-- utama", peran ini berubah diam-diam jadi juri pos biasa — bisa login, layar
-- terbuka, dan empat pos lainnya hilang tanpa pesan apa pun.
-- ============================================================================

-- Akunnya dibuat sebagai pemilik, sebelum `set role`.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000c1', 'koordinator@uji.local')
on conflict (id) do nothing;

insert into akun_panitia (user_id, username, peran, pos, is_active)
values ('00000000-0000-0000-0000-0000000000c1', 'koordinator.uji',
        'koordinator_pos', null, true)
on conflict (user_id) do update
  set peran = 'koordinator_pos', pos = null, is_active = true;

insert into akun_hak (user_id, fitur)
select '00000000-0000-0000-0000-0000000000c1', unnest(paket_peran('koordinator_pos'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 38.1  Database menerima namanya, dan MENOLAK memberinya pos.
--
-- Butir kedua yang penting: kalau koordinator boleh punya pos, pos_saya()
-- berhenti NULL dan ia jadi juri pos biasa dengan nama lain.
-- ---------------------------------------------------------------------------
do $blok$
declare v_pesan text;
begin
  begin
    update akun_panitia set pos = 3
    where user_id = '00000000-0000-0000-0000-0000000000c1';
    assert false, 'koordinator_pos seharusnya TIDAK boleh punya pos';
  exception when check_violation then
    v_pesan := sqlerrm;
  end;
  assert v_pesan is not null, 'check dua arah dari 0058 sudah tidak ada';
  raise notice '38.1 OK — koordinator_pos tidak bisa dikunci ke satu pos.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 38.2  Paketnya sama persis dengan juri pos, tidak lebih.
-- ---------------------------------------------------------------------------
do $blok$
begin
  assert paket_peran('koordinator_pos') @> array['pos','live_score'],
    'koordinator_pos harus memegang pos dan live_score';
  assert not (paket_peran('koordinator_pos') @> array['akun']),
    'koordinator_pos TIDAK mengelola akun';
  assert not (paket_peran('koordinator_pos') @> array['pengaturan']),
    'koordinator_pos TIDAK memegang pengaturan';
  assert not (paket_peran('koordinator_pos') @> array['pembayaran']),
    'koordinator_pos TIDAK memegang pembayaran — itu justru alasan peran ini ada';
  raise notice '38.2 OK — paketnya sama dengan juri pos, tidak lebih.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 38.3  pos_saya() NULL, dan itu yang membuka kelima pos.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;

do $blok$
declare v_pos smallint; v_n integer;
begin
  v_pos := pos_saya();
  assert v_pos is null, format('pos_saya() koordinator harus NULL, dapat %s', v_pos);
  assert boleh('pos'), 'koordinator harus memegang fitur pos';

  select count(distinct pos) into v_n from v_lembar_pos;
  assert v_n >= 2,
    format('koordinator seharusnya melihat lebih dari satu pos, terlihat %s', v_n);
  raise notice '38.3 OK — pos_saya() NULL, % pos terlihat.', v_n;
end $blok$;

-- ---------------------------------------------------------------------------
-- 38.4  Boleh MENULIS ke pos mana pun — diuji lewat jalur foto, yang pagarnya
--       persis sama bentuknya dengan simpan_nilai_massal.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_id uuid; v_pos smallint; v_n integer := 0;
begin
  for v_pos in select distinct pos from wahana order by pos loop
    select slug_lomba(coalesce(w.lomba, w.name)) into v_kode
    from wahana w where w.pos = v_pos order by w.sort_order, w.kode limit 1;
    v_id := catat_foto_masuk(v_pos, v_kode, 'Uji Koordinator',
                             'pos' || v_pos::text || '/' || v_kode || '/uji-koor.jpg', 1000);
    assert v_id is not null, format('koordinator ditolak di pos %s', v_pos);
    v_n := v_n + 1;
  end loop;
  assert v_n >= 2, format('hanya %s pos yang bisa ditulis', v_n);
  raise notice '38.4 OK — koordinator menulis ke % pos.', v_n;
end $blok$;

-- ---------------------------------------------------------------------------
-- 38.5  Juri pos biasa TETAP terkunci. Peran baru tidak boleh melonggarkan
--       yang lama — kalau pagarnya dilepas untuk koordinator, ia terlepas
--       untuk semua orang, dan tidak ada yang memberi tahu.
-- ---------------------------------------------------------------------------
reset role;
do $blok$
declare
  v_uid uuid; v_pos smallint; v_lain smallint; v_kode text; v_pesan text;
begin
  select user_id, pos into v_uid, v_pos from akun_panitia
  where peran = 'juri_pos' and is_active and pos is not null
  order by pos limit 1;
  if v_uid is null then
    raise notice '38.5 DILEWATI — tidak ada akun juri_pos aktif.';
    return;
  end if;
  select min(pos) into v_lain from wahana where pos <> v_pos;
  if v_lain is null then
    raise notice '38.5 DILEWATI — hanya ada satu pos berwahana.';
    return;
  end if;
  select slug_lomba(coalesce(w.lomba, w.name)) into v_kode
  from wahana w where w.pos = v_lain order by w.sort_order, w.kode limit 1;

  perform set_config('app.uid', v_uid::text, false);
  begin
    perform catat_foto_masuk(v_lain, v_kode, 'Uji',
                             'pos' || v_lain::text || '/' || v_kode || '/curi.jpg', 1000);
    assert false, format('juri pos %s menembus pos %s', v_pos, v_lain);
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak boleh mengunggah foto pos%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  raise notice '38.5 OK — juri pos tetap terkunci di posnya.';
end $blok$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih. Dari daun ke akar: foto dulu, lalu haknya, lalu akunnya.
-- ---------------------------------------------------------------------------
reset role;
delete from history where table_name = 'foto_lembar';
delete from foto_lembar where nama_lomba = 'Uji Koordinator';
delete from akun_hak    where user_id = '00000000-0000-0000-0000-0000000000c1';
delete from akun_panitia where user_id = '00000000-0000-0000-0000-0000000000c1';
delete from auth.users   where id      = '00000000-0000-0000-0000-0000000000c1';
