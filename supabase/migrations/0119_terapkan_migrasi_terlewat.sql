-- ============================================================================
-- hrcd-rekap : 0119_terapkan_migrasi_terlewat.sql
-- Pasang isi sepuluh migrasi yang tidak pernah sampai ke produksi.
--
-- APA YANG TERJADI. `apply-migration.yml` menerapkan SATU berkas per jalan,
-- manual, dan tidak ada tabel yang mencatat berkas mana yang sudah jalan.
-- Antara 0091 dan 0118, sepuluh berkas terlewat tanpa satu galat pun:
--
--   0091 intern_golongan            0103 restore_pos_last_entry
--   0098 pindah_kloter_dari_gerbang 0104 public_completeness_external_only
--   0099 anon_default_privileges    0105 expand_kloter_capacity
--   0100 gate_regu_lookup           0106 format_input_range_units
--   0101 guard_pos_completeness     0102 mark_printed_kloter_insertion
--
-- Yang menemukannya adalah lapangan, bukan CI: pembina mendaftarkan regu
-- Internal dan ditolak `regu_golongan_check`, karena constraint itu masih
-- milik 0001 dan hanya mengenal empat golongan eksternal.
--
-- MENGAPA BUKAN "JALANKAN ULANG SEPULUH BERKAS ITU". Empat objek di dalamnya
-- sudah ditulis ulang oleh migrasi yang LEBIH MUDA dan sudah diterapkan.
-- Menjalankan berkas lamanya sekarang justru MEMUNDURKAN produksi:
--
--   v_lembar_pos              milik 0091 -> sudah digantikan 0095
--   submit_pendaftaran        milik 0091 -> sudah digantikan 0110 lalu 0114
--   daftar_ulang_batch        milik 0102 -> sudah digantikan 0116
--   perkiraan_berangkat_kloter milik 0105 -> sudah digantikan 0118
--
-- Karena itu berkas ini memuat seluruh isi sepuluh migrasi tadi KECUALI empat
-- objek di atas. Sisanya tidak pernah disentuh migrasi mana pun sesudahnya,
-- jadi keadaan produksi untuk objek-objek itu persis sama dengan keadaan yang
-- dihadapi migrasi aslinya — salinannya di sini aman dijalankan, dan aman pula
-- dijalankan dua kali.
--
-- 0102 karena itu tidak menyumbang satu baris pun: seluruh isinya sudah
-- terwakili 0116.
--
-- Sesudah menerapkan ini, jalankan `supabase/checks/status_migrasi.sql` untuk
-- melihat seluruh jejaknya berbunyi ADA.
-- ============================================================================


-- ============================================================================
-- 0091 — Intern PA dan Intern PI menjadi golongan tersendiri.
-- ============================================================================
alter table regu drop constraint if exists regu_golongan_check;
alter table regu add constraint regu_golongan_check check (golongan in (
  'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
  'intern_pa', 'intern_pi'
));

alter table wahana drop constraint if exists wahana_golongan_check;
alter table wahana add constraint wahana_golongan_check check (
  golongan is null or golongan in (
    'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
    'intern_pa', 'intern_pi', 'intern'
  )
);

create or replace function komponen_berlaku(p_golongan_wahana text,
                                            p_golongan_regu   text)
returns boolean
language sql immutable
as $$
  select case
    when p_golongan_regu in ('intern_pa', 'intern_pi')
      then coalesce(p_golongan_wahana in (p_golongan_regu, 'intern'), false)
    else p_golongan_wahana is null or p_golongan_wahana = p_golongan_regu
  end
$$;

comment on function komponen_berlaku(text, text) is
  'Apakah komponen berlaku untuk satu regu. Marker wahana `intern` berlaku untuk Intern PA/PI; komponen umum tidak otomatis berlaku supaya lomba lapangan tidak ikut dinilai.';

-- Lima baris soal dibuat sebagai varian Intern. Baris asli tetap NULL agar
-- empat golongan eksternal tetap membacanya; `kolomPos()` menggabungkan kedua
-- varian berdasarkan nama sehingga layar masih menampilkan satu kolom.
insert into wahana
  (edisi, pos, kode, name, type, form, poin_maks,
   raw_terbaik, raw_terburuk, poin_benar, poin_salah, total_soal,
   rentang_mentah_min, rentang_mentah_maks, sort_order, tingkat, satuan,
   golongan, petunjuk, judul_isian, lomba, kode_lomba, jawaban_benar)
select
  edisi, pos, kode || '_intern', name, type, form, poin_maks,
  raw_terbaik, raw_terburuk, poin_benar, poin_salah, total_soal,
  rentang_mentah_min, rentang_mentah_maks, sort_order, tingkat, satuan,
  'intern', petunjuk, judul_isian, lomba, kode_lomba, jawaban_benar
from wahana
where edisi = edisi_aktif()
  and kode in ('keagamaan', 'kepramukaan', 'kesehatan',
               'pengetahuan_umum', 'logika')
on conflict (edisi, pos, kode) do update set
  name                = excluded.name,
  type                = excluded.type,
  form                = excluded.form,
  poin_maks           = excluded.poin_maks,
  raw_terbaik         = excluded.raw_terbaik,
  raw_terburuk        = excluded.raw_terburuk,
  poin_benar          = excluded.poin_benar,
  poin_salah          = excluded.poin_salah,
  total_soal          = excluded.total_soal,
  rentang_mentah_min  = excluded.rentang_mentah_min,
  rentang_mentah_maks = excluded.rentang_mentah_maks,
  sort_order          = excluded.sort_order,
  tingkat             = excluded.tingkat,
  satuan              = excluded.satuan,
  golongan            = excluded.golongan,
  petunjuk            = excluded.petunjuk,
  judul_isian         = excluded.judul_isian,
  lomba               = excluded.lomba,
  kode_lomba          = excluded.kode_lomba,
  jawaban_benar       = excluded.jawaban_benar;

-- Intern hanya memperoleh poin Soal Tulis dikurangi penalti waktu. Kolom
-- penalti lain tetap ada agar bentuk view tidak berubah, tetapi nilainya nol.
create or replace view v_total_skor with (security_invoker = on) as
select
  r.id            as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name          as nama_sekolah,
  r.golongan,
  case when r.golongan in ('intern_pa', 'intern_pi')
    then coalesce(pp.total_pos, 0)
    else coalesce(pp.total_pos, 0)
      + (((select count(*) from pos p
            where p.edisi = edisi_aktif()
              and exists (select 1 from wahana w
                          where w.edisi = p.edisi and w.pos = p.nomor))
          - coalesce(pp.jumlah_pos, 0)) * kp.nilai_pos_terlewat)
  end                                             as total_pos,
  pw.penalti_waktu,
  case when r.golongan in ('intern_pa', 'intern_pi') then 0
       when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
                                                  as penalti_checkout,
  case when r.golongan in ('intern_pa', 'intern_pi') then 0
       when c.regu_id is not null
         then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
                                                  as penalti_anggota,
  case when r.golongan in ('intern_pa', 'intern_pi')
    then coalesce(pp.total_pos, 0) - pw.penalti_waktu
    else coalesce(pp.total_pos, 0)
      + (((select count(*) from pos p
            where p.edisi = edisi_aktif()
              and exists (select 1 from wahana w
                          where w.edisi = p.edisi and w.pos = p.nomor))
          - coalesce(pp.jumlah_pos, 0)) * kp.nilai_pos_terlewat)
      - pw.penalti_waktu
      - case when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
      - case when c.regu_id is not null
          then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
  end                                             as total,
  pw.selisih_menit
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join (select regu_id, sum(poin_pos) as total_pos, count(*) as jumlah_pos
           from v_poin_pos group by regu_id) pp on pp.regu_id = r.id
join v_penalti_waktu pw  on pw.regu_id = r.id
left join closing_regu c on c.regu_id = r.id
cross join konfig_penalti kp
where kp.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas';


-- ============================================================================
-- 0098 — Petugas gerbang boleh memindahkan regu dari layar Keberangkatan.
-- ============================================================================
create or replace function pindah_kloter(
  p_nomor_dada integer, p_alasan text, p_kloter smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
  v_cfg edisi%rowtype;
  v_tujuan smallint;
  v_perlu_diumumkan boolean;
  v_tercetak boolean;
  v_lama smallint;
  v_tujuan_berangkat boolean;
begin
  if not boleh_apa_saja('keberangkatan', 'cetak_kloter') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;
  select * into v_cfg from edisi where is_active;
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));
  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then raise exception 'nomor dada % tidak dikenal', p_nomor_dada; end if;
  if v_regu.is_cancelled then raise exception 'regu % berstatus batal', p_nomor_dada; end if;
  v_lama := v_regu.kloter_nomor;
  if regu_sudah_berangkat(v_regu.id) then
    raise exception 'regu % ikut berangkat bersama kloter % — kalau itu keliru, batalkan dulu keberangkatan kloter itu lewat admin', p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    select k.nomor into v_tujuan from kloter k
    where k.jam_berangkat is null and k.nomor <= v_cfg.kloter_maks
    order by k.nomor desc limit 1;
  else
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
  end if;
  if v_tujuan is null then raise exception 'tidak ada kloter tersisa yang belum berangkat'; end if;
  if v_tujuan = v_lama then raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan; end if;

  select dicetak_pada is not null or jam_berangkat is not null,
         dicetak_pada is not null, jam_berangkat is not null
    into v_perlu_diumumkan, v_tercetak, v_tujuan_berangkat
  from kloter where nomor = v_tujuan;
  perform set_config('hrcd.izin_pindah', '1', true);
  update regu set
    kloter_nomor = v_tujuan,
    urutan_kloter = slot_kloter_berikutnya(v_tujuan),
    disisipkan_pada = case when v_perlu_diumumkan then now() else disisipkan_pada end,
    alasan_sisip = case when v_perlu_diumumkan then p_alasan else alasan_sisip end
  where id = v_regu.id;
  perform set_config('hrcd.izin_pindah', '0', true);

  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
    jsonb_build_object('kloter_nomor', v_lama, 'urutan_kloter', v_regu.urutan_kloter),
    jsonb_build_object('pindah_kloter', jsonb_build_object(
      'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
      'alasan', p_alasan, 'kloter_tujuan_sudah_dicetak', v_tercetak,
      'kloter_tujuan_sudah_berangkat', v_tujuan_berangkat)), auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada, 'kloter_lama', v_lama, 'kloter_baru', v_tujuan,
    'sisipan', v_perlu_diumumkan, 'tujuan_sudah_berangkat', v_tujuan_berangkat,
    'peringatan', nullif(concat_ws(' ',
      case when v_perlu_diumumkan then format(
        'Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
        p_nomor_dada, v_tujuan) end,
      case when v_tujuan_berangkat then format(
        'Kloter %s sudah berangkat, jadi nomor %s dinilai dari jam berangkat kloter itu.',
        v_tujuan, p_nomor_dada) end), ''));
end;
$$;

comment on function pindah_kloter(integer, text, smallint) is
  'Memindahkan regu secara manual dari meja registrasi atau garis start; hak cetak_kloter dan keberangkatan sama-sama membuka pintu.';

-- ============================================================================
-- 0099 — anon hanya boleh membaca yang memang milik halaman peserta.
-- ============================================================================

alter default privileges in schema public revoke all on tables from anon;

revoke all on all tables in schema public from anon;

grant select on sekolah, v_edisi_publik, v_fase_live, v_publik_ringkas,
                v_kelengkapan_publik
to anon;

-- ============================================================================
-- 0100 — Lookup regu dua meja gerbang tidak lagi bergantung hak Live Score.
-- ============================================================================
create or replace view v_regu_ringkas with (security_invoker = off) as
select
  r.id                                   as regu_id,
  r.nomor_dada,
  r.nama_regu,
  r.nama_ketua,
  s.name                                 as nama_sekolah,
  r.golongan,
  r.kloter_nomor                         as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  k.jam_berangkat is not null            as sudah_berangkat,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                           as sudah_ceklis,
  c.jam_datang,
  c.anggota_hadir,
  c.regu_id is not null                  as sudah_finish,
  r.disisipkan_pada is not null          as sisipan,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                    as target_datang
from regu r
join pendaftaran d       on d.id = r.pendaftaran_id
join sekolah s           on s.id = d.sekolah_id
left join kloter k       on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh_apa_saja('keberangkatan', 'kedatangan', 'daftar_ulang',
                     'pengaturan');

comment on view v_regu_ringkas is
  'Lookup operasional untuk staging dan finish. Definer agar tidak membuka pendaftaran beserta nomor WA; badannya wajib menjaga keberangkatan/kedatangan/daftar_ulang/pengaturan.';

grant select on v_regu_ringkas to authenticated;
revoke all on v_regu_ringkas from anon;

-- ============================================================================
-- 0101 + 0103 — Kelengkapan pos berpagar peran(), dan terakhir_masuk kembali.
-- 0103 adalah salinan termuda dari keduanya, jadi hanya ia yang dipasang.
-- ============================================================================
create or replace view v_kelengkapan_pos as
with regu_ikut as (
  select
    r.id,
    r.golongan,
    (k.jam_berangkat is not null)                                as sudah_berangkat,
    exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  left join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor                       as pos,
  p.name                        as nama_pos,
  p.bayangan,
  p.jumlah_komponen,
  count(ri.id)::int                                      as regu_total,
  count(ri.id) filter (where ri.sudah_berangkat)::int    as regu_berangkat,
  count(ri.id) filter (where ri.sudah_closing)::int      as regu_closing,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  count(ri.id) filter (where coalesce(t.jumlah, 0) = 0)::int  as kosong,
  count(ri.id) filter (
    where ri.sudah_closing
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as hilang,
  (select max(n.created_at)
   from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where w.edisi = edisi_aktif() and w.pos = p.nomor)    as terakhir_masuk
from v_pos p
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and peran() is not null
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

comment on view v_kelengkapan_pos is
  'Agregat kelengkapan dan waktu nilai terakhir seluruh pos untuk panitia aktif. Definer agar agregat lintas pos tidak menuntut hak baca nilai mentah; badan view wajib menjaga peran() is not null.';

grant select on v_kelengkapan_pos to authenticated, service_role;
revoke all on v_kelengkapan_pos from anon;

-- ============================================================================
-- 0104 — Kelengkapan halaman peserta menghitung regu Eksternal saja.
-- ============================================================================
create or replace view v_kelengkapan_publik as
with regu_ikut as (
  select r.id, r.golongan
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
    and r.golongan not in ('intern_pa', 'intern_pi')
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor          as pos,
  p.name           as nama_pos,
  p.jumlah_komponen,
  count(ri.id)::int as regu_total,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  case when count(ri.id) = 0 then 0 else
    floor(100.0 * count(ri.id) filter (
      where coalesce(t.jumlah, 0)
            = komponen_pos_golongan(p.nomor, ri.golongan)) / count(ri.id))::int
  end              as persen
from v_pos p
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and (select fase_live from status_acara) in ('progres', 'penuh')
group by p.nomor, p.name, p.jumlah_komponen;

grant select on v_kelengkapan_publik to anon, authenticated, service_role;


-- ============================================================================
-- 0105 — Sediakan 75 kloter. Fungsi perkiraannya sengaja dilewati: 0118 yang
-- berlaku sekarang, dan ia sudah membaca kloter_maks.
-- ============================================================================
update edisi
set kloter_dasar = greatest(kloter_dasar, 75),
    kloter_maks = greatest(kloter_maks, 75)
where is_active;

insert into kloter (nomor)
select generate_series(
  1,
  (select kloter_maks from edisi where is_active)
)::smallint
on conflict (nomor) do nothing;

-- ============================================================================
-- 0106 — Pesan rentang memakai satuan yang benar-benar diketik petugas.
-- ============================================================================
create or replace function rentang_input_nilai(
  p_min numeric,
  p_maks numeric,
  p_satuan text
) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_satuan = 'meter' then format(
      '%s - %s meter', trim_scale(p_min / 100), trim_scale(p_maks / 100))
    else format('%s - %s', trim_scale(p_min), trim_scale(p_maks))
  end
$$;

comment on function rentang_input_nilai(numeric, numeric, text) is
  'Rentang validasi dalam satuan yang diketik petugas; nilai meter tersimpan sebagai sentimeter.';

create or replace function simpan_nilai_massal(
  p_baris  jsonb,
  p_sumber text default 'upload',
  p_pos    smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_r      jsonb;
  v_regu   regu%rowtype;
  v_wahana wahana%rowtype;
  v_hasil  jsonb := '[]'::jsonb;
  v_status text;
  v_alasan text;
  v_idx    int := 0;
  v_pos    smallint;
  v_kunci  text;
  v_sudah  text[] := '{}';
  v_n1     numeric;
  v_n2     numeric;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
  else
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  end if;
  if p_sumber not in ('manual', 'upload') then
    raise exception 'sumber tidak dikenal: %', p_sumber;
  end if;

  for v_r in select * from jsonb_array_elements(p_baris) loop
    v_idx := v_idx + 1;
    v_status := 'tersimpan'; v_alasan := null;

    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      if nilai_tergembok(v_regu.id, v_pos) then
        raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
      end if;

      if not komponen_berlaku(v_wahana.golongan, v_regu.golongan) then
        raise exception 'Komponen ini untuk golongan lain.';
      end if;

      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        raise exception 'Input % harus antara %.',
          v_wahana.name,
          rentang_input_nilai(v_wahana.rentang_mentah_min,
                              v_wahana.rentang_mentah_maks,
                              v_wahana.satuan);
      end if;
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'Jumlah salah % harus antara 0 - %.',
          v_wahana.name,
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;

      insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
      values (v_regu.id, v_wahana.id, v_n1, v_n2, p_sumber, auth.uid())
      on conflict (regu_id, wahana_id) do update set
        nilai_1 = excluded.nilai_1,
        nilai_2 = excluded.nilai_2,
        source  = excluded.source,
        created_by = excluded.created_by,
        created_at = now()
      where nilai_mentah.nilai_1 is distinct from excluded.nilai_1
         or nilai_mentah.nilai_2 is distinct from excluded.nilai_2;

    exception when others then
      v_status := 'ditolak';
      v_alasan := sqlerrm;
    end;

    v_hasil := v_hasil || jsonb_build_object(
      'baris', v_idx,
      'nomor_dada', v_r ->> 'nomor_dada',
      'kode', v_r ->> 'kode',
      'status', v_status,
      'alasan', v_alasan);
  end loop;

  return v_hasil;
end;
$$;

grant execute on function simpan_nilai_massal(jsonb, text, smallint) to authenticated;
