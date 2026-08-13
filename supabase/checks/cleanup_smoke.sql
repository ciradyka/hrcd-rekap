-- Buang data sisa uji browser. Urutannya mengikuti foreign key, dan hanya
-- menyentuh baris yang namanya jelas-jelas penanda uji — tidak ada DELETE
-- tanpa WHERE di sini.
delete from regu where pendaftaran_id in (
  select d.id from pendaftaran d join sekolah s on s.id = d.sekolah_id
  where s.name like 'SMOKE TEST BROWSER%');
delete from pendaftaran where sekolah_id in (
  select id from sekolah where name like 'SMOKE TEST BROWSER%');
delete from sekolah where name like 'SMOKE TEST BROWSER%';
