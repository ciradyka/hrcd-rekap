-- ============================================================================
-- hrcd-rekap : 0130_bukti_transfer_link_drive.sql
--
-- Mengisi `pendaftaran.bukti_transfer` dengan LINK GOOGLE DRIVE bukti bayar
-- yang diunggah pembina lewat Google Form XXXVII, untuk keseratus baris yang
-- masuk lewat 0129.
--
-- ---------------------------------------------------------------------------
-- KENAPA LINK, BUKAN BERKAS DI STORAGE KITA
--
-- Berkasnya masih di Drive milik penyelenggara form dan BELUM bisa dibuka
-- siapa pun selain pemiliknya; aksesnya sedang diminta. Memindahkannya ke
-- bucket `bukti` menuntut akses itu lebih dulu, dan menunggu berarti panitia
-- tidak punya apa pun yang bisa diklik sampai izinnya turun.
--
-- Jadi yang disimpan sekarang linknya. Begitu aksesnya ada, berkasnya
-- dipindahkan dan kolom ini diganti path Storage — layar Meja Pembayaran
-- tidak perlu diubah lagi, karena ia sudah membedakan keduanya sendiri
-- (lihat `tautanBukti()` di web/js/api.js).
--
-- ---------------------------------------------------------------------------
-- BENTUK LINKNYA DIRAPIKAN
--
-- Form menuliskannya `drive.google.com/open?id=<ID>`. Yang disimpan di sini
-- `drive.google.com/file/d/<ID>/view` — bentuk yang sama persis isinya, tetapi
-- yang dibuka Drive sebagai pratinjau berkas alih-alih lewat pengalihan yang
-- kadang mendarat di halaman "Anda perlu izin" tanpa menyebut berkas mana.
-- ID-nya tidak disentuh.
--
-- ---------------------------------------------------------------------------
-- `metode_bayar` IKUT DIISI 'transfer'
--
-- Form XXXVII hanya menyediakan satu cara bayar — transfer ke rekening BJB
-- yang tertulis di judul kolomnya — dan keseratus pembina mengunggah
-- buktinya. Jadi "transfer" bukan tebakan melainkan satu-satunya yang bisa
-- mereka lakukan lewat form itu.
--
-- Ini TIDAK membuat siapa pun lunas. `status` tetap `menunggu_pembayaran`;
-- yang menentukan lunas tetap petugas di Meja Pembayaran, karena uangnya yang
-- menentukan, bukan adanya lampiran. Yang berubah cuma pilihan yang sudah
-- terpasang lebih dulu di dropdown — dan itu memang arti kolom ini sejak 0121.
--
-- Constraint `pendaftaran_transfer_berbukti` menuntut bukti ada bila metodenya
-- transfer, jadi kedua kolom WAJIB diisi dalam SATU update. Memisahkannya jadi
-- dua statement membuat yang pertama ditolak.
--
-- ---------------------------------------------------------------------------
-- BISA DIJALANKAN ULANG
--
-- Sasarannya dipilih lewat `kunci_kirim` yang sama dengan 0129, jadi ia
-- menyentuh persis seratus baris itu dan tidak pernah baris lain. Menjalankan
-- ulang menulis nilai yang sama.
--
-- WHERE-nya berarti, bukan formalitas: ekstensi `safeupdate` aktif di produksi
-- dan menolak UPDATE tanpa WHERE (CLAUDE.md 14.6), dan tanpa pagar itu satu
-- migrasi seperti ini menimpa bukti SELURUH pendaftaran, termasuk yang
-- diunggah pembina lewat form kita sendiri.
-- ============================================================================

create temporary table impor_bukti (baris integer primary key, tautan text not null);

insert into impor_bukti (baris, tautan) values

  (2, 'https://drive.google.com/file/d/1pwjQyLb2xAYxtkcorUEVtKHBmDIhJY53/view'),
  (3, 'https://drive.google.com/file/d/1VhkpfzZvLvAGzhV3h6Zk6xyqQv_xdYxr/view'),
  (4, 'https://drive.google.com/file/d/1Wlmf2d8t7W9wu23x0KJjk3PFe1iwhdvQ/view'),
  (5, 'https://drive.google.com/file/d/1KPr4UIt1l_iiM2UgYz7an_ntTU39UGrj/view'),
  (6, 'https://drive.google.com/file/d/1vP8R3CCXUL9PJAb22EphNxrrWvBE3UKo/view'),
  (7, 'https://drive.google.com/file/d/18cD6fE5ujvqplmc_IGNdIOyaEi0o0CCg/view'),
  (8, 'https://drive.google.com/file/d/1cV7jsC5B0X26WL6pkcU2TIQvYlF2o_BU/view'),
  (9, 'https://drive.google.com/file/d/1Vt4JxAKcoRs37Idvsyu39kdZbFgDQkL3/view'),
  (10, 'https://drive.google.com/file/d/15H2kVodOM-NryRSMBclXl2yFUA1JZoIL/view'),
  (11, 'https://drive.google.com/file/d/1t-6grAT4gK1Ni_xmI2EytnOd0-DasiRj/view'),
  (12, 'https://drive.google.com/file/d/1JSGLP_UmRIUf2COroAAelIbneuGIbkdm/view'),
  (13, 'https://drive.google.com/file/d/1hQWGMpVvqlHKOuLexJkKD3_5KKbE0JE8/view'),
  (14, 'https://drive.google.com/file/d/1SJrV4lHmnamo_8YowLhc5mgp330kkxRg/view'),
  (15, 'https://drive.google.com/file/d/1-RAEvQquwFwiDixIziRfgXaMg0tmd3y2/view'),
  (16, 'https://drive.google.com/file/d/1bcY2lTRVfpzlTbD0-czhm4-2J53ctk6-/view'),
  (17, 'https://drive.google.com/file/d/1NACjw0VIHHYpPSKvcIhahRd_MKHx8LO1/view'),
  (18, 'https://drive.google.com/file/d/1ZkypOvEQbTlndN3tyHeaRMbxSZI4mK9S/view'),
  (19, 'https://drive.google.com/file/d/1tetQW_3mJYfwgFg0glY1p7Js4rNYL5qr/view'),
  (20, 'https://drive.google.com/file/d/1JmDpNyA7fjrnn-Mr1n76EBxgCtnhNHk-/view'),
  (21, 'https://drive.google.com/file/d/1RHbAHdPsfadhEUI-R3cCiYPo37BeGxz6/view'),
  (22, 'https://drive.google.com/file/d/1aBbezeWoRHumlnfLpecjwTi3gV9Oy7yj/view'),
  (23, 'https://drive.google.com/file/d/1xBBDPw88essWP1Eq1683oqtjdS1XeGLC/view'),
  (24, 'https://drive.google.com/file/d/1ydi2Syk-PqcW0yhIB7ztNBT1tK4XpzhQ/view'),
  (25, 'https://drive.google.com/file/d/1MvMRPKrIPY-LsLVXw07sd7ZG7udKcQj4/view'),
  (26, 'https://drive.google.com/file/d/1kaxBZsiroeqxmbiQX6cuoVUd5RnQCK58/view'),
  (27, 'https://drive.google.com/file/d/18dludaqIt6HKD-J4Pr-ogjaadDEIINEE/view'),
  (28, 'https://drive.google.com/file/d/1yn0o-lDvqYhsNOcbgW5BQFcP0impdK57/view'),
  (29, 'https://drive.google.com/file/d/1DT6dGMs8yv5oFQJ6LOqMp-sbFgvtZhRJ/view'),
  (30, 'https://drive.google.com/file/d/11I-9wjNpSMZRqA2NgiAhLPamPw8iZ4Yp/view'),
  (31, 'https://drive.google.com/file/d/1Bv5BB4XpHmuBofTAQGgIeiuRkKkSN_1N/view'),
  (32, 'https://drive.google.com/file/d/13dzePB4cGbFbKgLLLZkH_ltaPY1-IieM/view'),
  (33, 'https://drive.google.com/file/d/1BT8yBSYAYjwSIIjXvUqMntFH28jXmS6s/view'),
  (34, 'https://drive.google.com/file/d/1IGikXQ5FySIC-ohlcOT6dF5vxd2FloCE/view'),
  (35, 'https://drive.google.com/file/d/1LIQhERLI09FuqELMnQ8LmtM4LTDqVT4A/view'),
  (36, 'https://drive.google.com/file/d/1n0k7ytaZEzMLtgZxwHGk0R_99bfRbXv9/view'),
  (37, 'https://drive.google.com/file/d/1Dsn7X83OVY9UAOTZ5dHV-6FutWa11zgd/view'),
  (38, 'https://drive.google.com/file/d/1If_FwMS5K5TPxl3GfOnkIlAMTInJs87R/view'),
  (39, 'https://drive.google.com/file/d/16aSstzVWgFpiS1LZMZVJcusfZ1dABDF3/view'),
  (40, 'https://drive.google.com/file/d/1IJOpw6Ftug28BKOi6cUhInWND8Op92n0/view'),
  (41, 'https://drive.google.com/file/d/16sJmEu8R8lEwq3UJAOji8hLGR3EDHFdF/view'),
  (42, 'https://drive.google.com/file/d/1fsDx3Vno-q1B4ODoybV6K1vJfqB3RLg7/view'),
  (43, 'https://drive.google.com/file/d/1csmbzysOb3v7AJAYiUqeyO6fEm8FqSvq/view'),
  (44, 'https://drive.google.com/file/d/1OlrHBssV0ij5awXGFvsBTN_vmM-3a_gr/view'),
  (45, 'https://drive.google.com/file/d/1wc_ZH_mfDYLojZOFR4ifqbOg8YrpzSfN/view'),
  (46, 'https://drive.google.com/file/d/1ZiDSSjvtIfJb0qxpealnWkv5PqFz7u4W/view'),
  (47, 'https://drive.google.com/file/d/191kvFjbyDLOw20R6dlJlPjTY3EViQ8N-/view'),
  (48, 'https://drive.google.com/file/d/1ewDMG8UrPYOajxWBT54HpgsG-_L9tkKU/view'),
  (49, 'https://drive.google.com/file/d/1PZJFNPLIOxrXw5FG4-BrJSJGx8W1PZg3/view'),
  (50, 'https://drive.google.com/file/d/1sIXoVvv2xquS3dF59vVM_rWRqpkKaWpS/view'),
  (51, 'https://drive.google.com/file/d/1BSfKtwPPBo5rp-6a3EA6D0EMkSQNd1st/view'),
  (52, 'https://drive.google.com/file/d/1UFwVW1XBqWxBM07yEiBaSZuoYNVHvCTJ/view'),
  (53, 'https://drive.google.com/file/d/1l_qBS3YfL1q5-LOJKnwJi2Ivz8EXZXEC/view'),
  (54, 'https://drive.google.com/file/d/1k823nFso3F1Q8vLZ4ovpG_hiN2cNAK5U/view'),
  (55, 'https://drive.google.com/file/d/1WTTo4SQOZkbyGmlNz45_ScXzFfJJ58-a/view'),
  (56, 'https://drive.google.com/file/d/1TdYKHr9o7u_hu6N2G3aMsd6nGZybWds-/view'),
  (57, 'https://drive.google.com/file/d/1OFNJlaEROPJRshGIpIL7hO4pErDdx4GK/view'),
  (58, 'https://drive.google.com/file/d/1g8xchpU3VSKxTBWORXlpwozX10EUulED/view'),
  (59, 'https://drive.google.com/file/d/1p7R2TueTPn-W9KkT3oOPFEthxrBexl2o/view'),
  (60, 'https://drive.google.com/file/d/1h0vuNhB7o7CEutbRL3dGLXKd3dtOrqcn/view'),
  (61, 'https://drive.google.com/file/d/11_l_LbjQPlb0C-T-Yl5T6O7aKuZcsPk8/view'),
  (62, 'https://drive.google.com/file/d/11L6Ctmib3B6PKMFJVzemPI5y225tA5MP/view'),
  (63, 'https://drive.google.com/file/d/183YZJGkkwgJjBffXkAGY8vZNPoMOJYWj/view'),
  (64, 'https://drive.google.com/file/d/1_eTLl-dRWb56mx_U3gPhB2APwGW_5m04/view'),
  (65, 'https://drive.google.com/file/d/1zWZIMO6L3QAfRJUlww1OBEPV-N5PKOeL/view'),
  (66, 'https://drive.google.com/file/d/1bXeVPVQW6ecM9DrZl9tZoIeMNp5Dm_Lb/view'),
  (67, 'https://drive.google.com/file/d/1i9sDTxC9JJT2pQL91Xmr9her7m4rYZPS/view'),
  (68, 'https://drive.google.com/file/d/14yKabJdtRLpvisZHlSmwPP1KDDfMUsxV/view'),
  (69, 'https://drive.google.com/file/d/1LNTQ0CicZRGXAgknQPm0GOSVN3j3dvFZ/view'),
  (70, 'https://drive.google.com/file/d/1XIsMdMLJHEVQXdROHV2bfJUNsOcS6b-v/view'),
  (71, 'https://drive.google.com/file/d/1kF9JpaBnKy8D6pUaB4mOJkxQU5zRxJRR/view'),
  (72, 'https://drive.google.com/file/d/1GLy64l1XmJojb5E07fdrWLuKZ7JdFCEH/view'),
  (73, 'https://drive.google.com/file/d/1lRcE6MRUSfCwqDaL8EtPYiuTwitASSv4/view'),
  (74, 'https://drive.google.com/file/d/1GpigD4lD7LBSdbxk92Nl0EcuYnWiuReM/view'),
  (75, 'https://drive.google.com/file/d/1tZ5Yg0b0pnrvue3M9siHVpjAmiLarIr2/view'),
  (76, 'https://drive.google.com/file/d/1UOGYjQEMGUzY5cJ4pbS4H_bNfee05RjE/view'),
  (77, 'https://drive.google.com/file/d/1031Kmwxwmsx8NRobe4BrNYWHbnKEKjCX/view'),
  (78, 'https://drive.google.com/file/d/1ur7nO1vmcoUNbLE0noVE0R5f0dAbjRtH/view'),
  (79, 'https://drive.google.com/file/d/1z0zKH8CYC3AhIgjt_EPwP39SC0d9FATV/view'),
  (80, 'https://drive.google.com/file/d/1pjnOCT_tJo_WLgXFNS2SsxxWHQIC_xJu/view'),
  (81, 'https://drive.google.com/file/d/1oEs6HGL_TUqcLrTtCBAbPsys-_vb5WV-/view'),
  (82, 'https://drive.google.com/file/d/1ZvRNyFOoCgoiNiiT0KUXooGnXIm6JoJ2/view'),
  (83, 'https://drive.google.com/file/d/13rJ0dM3avgF_HW_6-QTiypgsRSGIWfsb/view'),
  (84, 'https://drive.google.com/file/d/1gwh_dqRHahtvPw_Q3oujYVP-4JNzBcTx/view'),
  (85, 'https://drive.google.com/file/d/1m0BK-gzIxrAVMPEL_4uPuDiAOmsBHGo-/view'),
  (86, 'https://drive.google.com/file/d/1R4VjGrhTVcWf66FfPApFdz6tydcoBTtS/view'),
  (87, 'https://drive.google.com/file/d/1rnMVLACgAviJ_I6A0KKAnLpqzWBixuOB/view'),
  (88, 'https://drive.google.com/file/d/1x9jFVWYLe6fIsZRp79zPnnVHKb7YA8z6/view'),
  (89, 'https://drive.google.com/file/d/1DuZZx4tbPIwWNLVjla-tOZxRuuU8inJp/view'),
  (90, 'https://drive.google.com/file/d/1PATT4HT9ZsmqIurkGd3ZT7dt-Md9PBug/view'),
  (91, 'https://drive.google.com/file/d/1PVdW0Rx5Tq1-Kdl7_kjif6R_ag7jL7sI/view'),
  (92, 'https://drive.google.com/file/d/1Z-SNpVDr-QjP7kH4HQLKdwlGYoiSn71I/view'),
  (93, 'https://drive.google.com/file/d/1zAz9V9wyrB1-9NKfDVOFgPNL3KGLRTNI/view'),
  (94, 'https://drive.google.com/file/d/123Uel0xQycHRvYHe10S3iF1RFb7M3sT5/view'),
  (95, 'https://drive.google.com/file/d/1uOD5fs4-Tqv9Pzm1GNnZq60HLmGfXEl0/view'),
  (96, 'https://drive.google.com/file/d/1mljb5Svro6_FYsSJgIGv4OY6v_iN3Zgx/view'),
  (97, 'https://drive.google.com/file/d/1bah6KswwtArKz6O6VTcKVUfWpH98F45i/view'),
  (98, 'https://drive.google.com/file/d/16yvsVattt8SewTITsFDkBayfK6C820rZ/view'),
  (99, 'https://drive.google.com/file/d/1zhoS5GAiQ_Oc6mzfpIZiLwkIf8qJqxvv/view'),
  (100, 'https://drive.google.com/file/d/1vPC6D7EuxaBVelYw7UwTUF122WviFvU7/view'),
  (101, 'https://drive.google.com/file/d/1mbfMDaz0kW7LVRhfGJ07WtJif0jQu0eA/view');

do $blok$
declare v_n integer;
begin
  update pendaftaran d
     set bukti_transfer = b.tautan,
         metode_bayar   = 'transfer'
    from impor_bukti b
   where d.kunci_kirim = md5('hrcd-xxxvii-form-' || b.baris)::uuid;

  get diagnostics v_n = row_count;
  raise notice '0130: % pendaftaran diberi link bukti transfer.', v_n;

  if v_n <> (select count(*) from impor_bukti) then
    raise exception '0130: % dari % baris form tidak ketemu pendaftarannya — jalankan 0129 dulu',
      (select count(*) from impor_bukti) - v_n, (select count(*) from impor_bukti);
  end if;
end;
$blok$;

-- Pagar: tidak boleh ada satu pun dari keseratus yang tertinggal tanpa link,
-- dan tidak boleh ada yang linknya bukan Drive. Yang dihitung isinya, bukan
-- bahwa update-nya berjalan.
do $blok$
declare v_n integer;
begin
  select count(*) into v_n
  from impor_bukti b
  join pendaftaran d on d.kunci_kirim = md5('hrcd-xxxvii-form-' || b.baris)::uuid
  where d.bukti_transfer like 'https://drive.google.com/file/d/%/view'
    and d.metode_bayar = 'transfer'
    and d.status = 'menunggu_pembayaran';

  if v_n <> (select count(*) from impor_bukti) then
    raise exception '0130: baru % dari % baris yang benar', v_n,
      (select count(*) from impor_bukti);
  end if;
  raise notice '0130: % bukti transfer terpasang, semuanya masih menunggu pembayaran.', v_n;
end;
$blok$;

drop table impor_bukti;
