-- ============================================================================
-- hrcd-rekap : 0091_intern_golongan.sql
-- Intern PA dan Intern PI menjadi golongan tersendiri.
--
-- Peserta internal berasal dari SMAN 1 Ciamis. Mereka hanya dinilai dari lima
-- Soal Tulis dan ketepatan waktu; seluruh lomba lapangan, penalti tanpa
-- checkout, penalti anggota, dan nilai pos terlewat tidak berlaku. Klasemennya
-- tetap dipisah menjadi Intern PA dan Intern PI.
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

-- Regu Intern tidak boleh muncul di lembar/input lomba lapangan. Selain
-- mengurangi kebisingan, ini mencegah petugas mengira sel kosong sebagai
-- pekerjaan yang belum diisi. Badan view mengikuti 0065; predikat EXISTS di
-- akhir adalah satu-satunya perubahan.
create or replace view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,
  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,
  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,
  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos,
  nilai_tergembok(r.id, p.nomor) as terkunci
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh('pos')
  and (pos_saya() is null or p.nomor = pos_saya())
  and exists (
    select 1 from wahana w
    where w.edisi = p.edisi and w.pos = p.nomor
      and komponen_berlaku(w.golongan, r.golongan)
  );

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

-- Salinan fungsi terakhir dari 0061; hanya daftar golongan sah yang bertambah.
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', v_ada.jumlah_regu * (select biaya_per_regu from edisi where is_active),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;
  if coalesce(trim(p_nama_sekolah), '') = '' then
    raise exception 'nama sekolah wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in (
      'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
      'intern_pa', 'intern_pi'
    ) then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;
  end loop;

  select id into v_sekolah from sekolah
   where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);

  if v_sekolah is null then
    insert into sekolah (name, address)
    values (trim(p_nama_sekolah), trim(coalesce(p_alamat_sekolah, '')))
    on conflict (kunci_sekolah(name)) do nothing
    returning id into v_sekolah;

    if v_sekolah is null then
      select id into v_sekolah from sekolah
       where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);
    end if;
  end if;

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan'
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', v_n * (select biaya_per_regu from edisi where is_active),
    'terkirim_ulang', false);
end;
$$;
