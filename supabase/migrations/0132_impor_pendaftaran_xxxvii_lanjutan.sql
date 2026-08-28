-- ============================================================================
-- hrcd-rekap : 0132_impor_pendaftaran_xxxvii_lanjutan.sql
--
-- Memasukkan jawaban Google Form HRCD XXXVII mulai baris 143
-- (28 Agustus 2026 14:01:17, Bunga Patroman) sampai baris 149.
--
-- Dua baris adalah kiriman ulang, bukan regu baru. Baris 143 diulang lebih
-- rapi pada baris 145 dengan lima anggota Bunga Patroman yang sama; baris 146
-- diulang pada baris 148 dengan lima anggota ROMUSA yang sama. Versi terakhir
-- dipakai, sehingga tujuh baris sumber menjadi lima respons unik.
--
-- Baris yang sudah telanjur dimasukkan lewat form aktif dilengkapi, bukan
-- dibuat lagi. Nama dan nomor regu yang sudah mempunyai nomor dada tidak
-- diubah. Satu pendaftaran manual dapat memuat beberapa regu; karena satu nota
-- hanya mempunyai satu kolom bukti, link baris terakhir dalam pendaftaran
-- gabungan menjadi link nota itu secara deterministik.
--
-- Aman dijalankan ulang: baris baru memakai kunci_kirim deterministik. Status
-- pembayaran, nomor dada, kloter, dan keadaan operasional lain tidak disentuh.
-- ============================================================================

create temporary table impor_form_lanjutan (
  baris       integer primary key,
  sekolah     text    not null,
  nama_regu   text    not null,
  golongan    text    not null,
  nama_ketua  text    not null,
  anggota     text[]  not null,
  kontak_wa   text    not null,
  nama_kontak text,
  bukti       text    not null
);

insert into impor_form_lanjutan
  (baris, sekolah, nama_regu, golongan, nama_ketua, anggota,
   kontak_wa, nama_kontak, bukti) values
  (144, 'MAN 2 Ciamis', 'CAKRAWIRA', 'penegak_pa',
   'IKBAL MAULANA',
   array['MUHAMMAD FAUZAN KAMIL MUBAROK', 'ADE ILHAM FATHUL BARRI', 'ALDI AKBAR FIRMANSYAH', 'RIZKY DENDY RAMADHAN'],
   '085927721993', 'Yudi',
   'https://drive.google.com/file/d/1ycMKHUfKbw6pv_Ngw5YlxRjiiYxXdTYD/view'),
  (145, 'SMAN 1 Banjar', 'Bunga Patroman', 'penegak_pi',
   'Aulia Ramadhani Putri',
   array['Nabila Rizqia Rahmat', 'Davina Dzikra Nurfawwaza', 'Naura Anindya Putri', 'Tasya Tanti Apriliani'],
   '085220567876', null,
   'https://drive.google.com/file/d/1iDiDnAryQbINrS4MHN40J9WhepFQQDsg/view'),
  (147, 'MAN 1 Ciamis', 'Spartan scout 666', 'penegak_pa',
   'M. Dhieka Rahmat Ghazali',
   array['Muhammad Dzakwan Aushof', 'Muhamad Fakhrul Musyaffa', 'Fadlan Ikbalurrahman', 'Rafif Fauzan Athallah'],
   '083130965734', null,
   'https://drive.google.com/file/d/1f6TmDTH-8nhTs5P5io97oJY2t8aoLxQE/view'),
  (148, 'SMAN 2 Ciamis', 'ROMUSA', 'penegak_pi',
   'Tresnawati Maulidia',
   array['Fitria Septiana', 'Seni Nur Septiani', 'Natara Qalbi Alfaathir', 'Qisty Aulia Anwar'],
   '082262634124', null,
   'https://drive.google.com/file/d/1mTQcspEgkKUcZZRKyNvIgCUwNy5c7I7c/view'),
  (149, 'SMAN 2 Ciamis', 'SRIKANDI NUSANTARA', 'penegak_pi',
   'SITI NURHIDAYAH',
   array['MAHARANI RAJWA ALMIRA', 'BRAINY QURRA A''YUN', 'LISANA SHIDQI ALIYYA', 'AULIA ALTAFUNYSA'],
   '082262634124', 'Ibu Nurislah',
   'https://drive.google.com/file/d/1yF0qNcwQfEvT4L1-sM6EpiMyGqWNXHPS/view');

create temporary table impor_sekolah_lanjutan (nama text primary key);

insert into impor_sekolah_lanjutan (nama)
select distinct sekolah from impor_form_lanjutan;

create temporary table impor_hasil_lanjutan (
  baris          integer primary key references impor_form_lanjutan (baris),
  pendaftaran_id uuid not null
);

do $blok$
declare
  v_s record;
  v_n integer := 0;
begin
  for v_s in select * from impor_sekolah_lanjutan order by nama loop
    if not exists (
      select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(v_s.nama)
    ) then
      insert into sekolah (name, address) values (v_s.nama, '');
      v_n := v_n + 1;
      raise notice '0132: sekolah baru - %', v_s.nama;
    end if;
  end loop;
  raise notice '0132: % sekolah baru dibuat.', v_n;
end;
$blok$;

do $blok$
declare
  v_f       record;
  v_batch   uuid;
  v_sek     uuid;
  v_kunci   uuid;
  v_kode    text;
  v_pakai   record;
  v_baru    integer := 0;
  v_ada     integer := 0;
begin
  for v_f in select * from impor_form_lanjutan order by baris loop
    v_batch := null;
    v_kunci := md5('hrcd-xxxvii-form-' || v_f.baris)::uuid;

    select id into v_sek from sekolah
     where kunci_sekolah(name) = kunci_sekolah(v_f.sekolah);
    if v_sek is null then
      raise exception '0132: sekolah % tidak ketemu setelah dibuat', v_f.sekolah;
    end if;

    select id into v_batch from pendaftaran where kunci_kirim = v_kunci;

    if v_batch is null then
      select r.pendaftaran_id into v_batch
      from regu r
      join pendaftaran d on d.id = r.pendaftaran_id
      join sekolah s on s.id = d.sekolah_id
      where not r.is_cancelled
        and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'))
        and r.golongan = v_f.golongan
        and (kunci_sekolah(s.name) = kunci_sekolah(v_f.sekolah)
             or d.kontak_wa = v_f.kontak_wa);

      if v_batch is not null then
        v_ada := v_ada + 1;
      elsif exists (
        select 1 from regu r
        where not r.is_cancelled
          and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g'))
            = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'))
      ) then
        select s.name as sekolah, r.golongan, r.nama_ketua, r.anggota,
               d.kontak_wa
          into v_pakai
          from regu r
          join pendaftaran d on d.id = r.pendaftaran_id
          join sekolah s on s.id = d.sekolah_id
         where not r.is_cancelled
           and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g'))
             = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'));

        raise exception '0132: nama % baris % sudah dipakai <% / % / % / % / %>; sumber <% / % / % / % / %>',
          v_f.nama_regu, v_f.baris,
          v_pakai.sekolah, v_pakai.golongan, v_pakai.nama_ketua,
          v_pakai.anggota, v_pakai.kontak_wa,
          v_f.sekolah, v_f.golongan, v_f.nama_ketua,
          v_f.anggota, v_f.kontak_wa;
      end if;
    end if;

    if v_batch is null then
      loop
        v_kode := 'HRCD' || edisi_aktif() || '-' ||
                  upper(substr(md5(gen_random_uuid()::text), 1, 6));
        exit when not exists (
          select 1 from pendaftaran where kode_pembayaran = v_kode
        );
      end loop;

      insert into pendaftaran (
        sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
        jumlah_regu, kontak_wa, kunci_kirim, nama_kontak,
        metode_bayar, bukti_transfer
      ) values (
        v_sek, v_kode, false, 0, 1, v_f.kontak_wa, v_kunci,
        v_f.nama_kontak, 'transfer', v_f.bukti
      ) returning id into v_batch;

      insert into regu (
        pendaftaran_id, nama_regu, nama_ketua, golongan, anggota
      ) values (
        v_batch, v_f.nama_regu, v_f.nama_ketua, v_f.golongan,
        nullif(v_f.anggota, '{}')
      );
      v_baru := v_baru + 1;
    else
      update pendaftaran
         set sekolah_id     = v_sek,
             kontak_wa      = v_f.kontak_wa,
             nama_kontak    = coalesce(nama_kontak, v_f.nama_kontak),
             metode_bayar   = 'transfer',
             bukti_transfer = v_f.bukti
       where id = v_batch;

      update regu
         set nama_regu  = case
                            when nomor_dada is null then v_f.nama_regu
                            else nama_regu
                          end,
             nama_ketua = v_f.nama_ketua,
             anggota    = nullif(v_f.anggota, '{}')
       where pendaftaran_id = v_batch
         and not is_cancelled
         and lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g'))
           = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'));
    end if;

    insert into impor_hasil_lanjutan (baris, pendaftaran_id)
    values (v_f.baris, v_batch);
  end loop;

  raise notice '0132: % pendaftaran dibuat, % yang sudah ada dilengkapi.',
    v_baru, v_ada;
end;
$blok$;

do $blok$
declare
  v_n integer;
begin
  select count(*) into v_n
  from impor_form_lanjutan f
  join impor_hasil_lanjutan h on h.baris = f.baris
  join pendaftaran d
    on d.id = h.pendaftaran_id
   and d.metode_bayar = 'transfer'
   and d.bukti_transfer like 'https://drive.google.com/file/d/%/view'
  join regu r
    on r.pendaftaran_id = d.id
   and r.golongan = f.golongan
   and r.nama_ketua = f.nama_ketua
   and r.anggota = f.anggota
   and not r.is_cancelled
  join sekolah s
    on s.id = d.sekolah_id
   and kunci_sekolah(s.name) = kunci_sekolah(f.sekolah);

  if v_n <> (select count(*) from impor_form_lanjutan) then
    raise exception '0132: baru % dari % respons unik yang terpasang lengkap',
      v_n, (select count(*) from impor_form_lanjutan);
  end if;
  raise notice '0132: % respons unik terpasang lengkap.', v_n;
end;
$blok$;

drop table impor_hasil_lanjutan;
drop table impor_form_lanjutan;
drop table impor_sekolah_lanjutan;
