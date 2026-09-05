/* ============================================================================
   hrcd-rekap : nomor-dada-series.mjs — dua deret nomor dada (migrasi 0116).

   Murni perhitungan: tidak membaca DOM dan tidak memanggil server. Karena itu
   aturan yang sama bisa diuji di Node dan dipakai layar.

   Kain nomor dada dicetak dalam DUA set yang sama-sama mulai dari 001, jadi
   Internal diketik 1001-1250 sementara Eksternal tetap 1-500. Batasnya tidak
   ditulis di berkas ini — ia datang dari `v_rentang_nomor_dada`, karena yang
   menyatakan "sampai berapa" adalah stok kain yang benar-benar dibawa
   panitia. Panitia tahun depan mengubah stoknya, bukan kodenya.

   Dipakai dua layar. Meja Daftar Ulang menolak nomor dari deret yang salah
   sebelum dikirim — kain Internal bertulis 001 sama seperti kain Eksternal, dan
   mengetik apa yang terbaca adalah hal paling wajar sedunia. Input Pos
   mencetak lembar cadangan hanya pada nomor yang benar-benar ada; tanpa itu
   ia mencetak 500 baris kosong di antara 500 dan 1001, nomor yang tidak
   pernah dibawa siapa pun.

   Pagar yang sesungguhnya tetap di database (`nomor_dada_sesuai_deret`).
   Yang di sini menahan kekeliruan di kotaknya, bukan menggantikan yang di
   sana.
   ========================================================================== */

export const golonganIntern = (golongan) => String(golongan || "").startsWith("intern_");

/** Daftar regu ini memberi nomor kepada Internal? Satu pendaftaran selalu satu
 *  jenis peserta, jadi praktisnya ini "batch Internal" — tetapi yang diperiksa
 *  tetap golongan REGUNYA, patokan yang sama dengan pagar di database. */
export const deretIntern = (daftar) => daftar.some(r => golonganIntern(r.golongan));

/** Seluruh nomor yang ada di stok, kedua deret berurutan. */
export function nomorStok(rentang) {
  const keluar = [];
  for (const [dari, sampai] of [[rentang.eksternalMulai, rentang.eksternalSampai],
                                [rentang.internMulai, rentang.internSampai]]) {
    if (!dari || !sampai) continue;    // deret kosong: stok belum diisi admin
    for (let n = dari; n <= sampai; n++) keluar.push(n);
  }
  return keluar;
}

/** Nomor ini milik deret golongannya? Deret yang kosong tidak menghakimi
 *  apa pun — pagarnya di database tetap yang terakhir memutuskan. */
export function deretCocok(rentang, golongan, nomor) {
  const intern = golonganIntern(golongan);
  const dari = intern ? rentang.internMulai : rentang.eksternalMulai;
  const sampai = intern ? rentang.internSampai : rentang.eksternalSampai;
  if (!dari || !sampai) return true;
  return nomor >= dari && nomor <= sampai;
}

/** Kalimat yang sama bunyinya dengan `pesan_deret_nomor_dada()` di database.
 *  Angkanya dari rentang yang sama, jadi keduanya tidak bisa berselisih —
 *  yang harus dijaga tangan cuma bentuk kalimatnya. */
export function pesanDeret(rentang, golongan) {
  const intern = golonganIntern(golongan);
  return `Nomor dada ${intern ? "intern" : "eksternal"} adalah dari `
    + `${intern ? rentang.internMulai : rentang.eksternalMulai} - `
    + `${intern ? rentang.internSampai : rentang.eksternalSampai}.`;
}
