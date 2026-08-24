/* ============================================================================
   Kalkulator pembagian kloter dan waktu keberangkatan.

   Murni perhitungan: tidak membaca DOM dan tidak menyimpan ke database. Karena
   itu rumus yang sama bisa diuji di Node dan dipakai Kalkulator Keberangkatan.
   ========================================================================== */

function menitDariJam(jam) {
  const cocok = String(jam || "").match(/^(\d{2}):(\d{2})$/);
  if (!cocok) return null;
  const jamAngka = Number(cocok[1]);
  const menitAngka = Number(cocok[2]);
  if (jamAngka > 23 || menitAngka > 59) return null;
  return jamAngka * 60 + menitAngka;
}

function jamDariMenit(total) {
  const jam = Math.floor(total / 60);
  const menit = total % 60;
  return `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
}

/**
 * Isi kloter FIFO dengan kuota terpisah Eksternal dan Intern, lalu sebarkan
 * jam K1 sampai kloter terakhir merata di seluruh jendela.
 */
export function hitungRekomendasiKloter({
  waktuPertama,
  waktuTerakhir,
  jumlahEksternal,
  jumlahIntern,
  maksEksternalPerKloter,
  maksInternPerKloter,
  kloterMaks,
}) {
  const pertama = menitDariJam(waktuPertama);
  const terakhir = menitDariJam(waktuTerakhir);
  const eksternal = Number(jumlahEksternal);
  const intern = Number(jumlahIntern);
  const kapasitasEksternal = Number(maksEksternalPerKloter);
  const kapasitasIntern = Number(maksInternPerKloter);
  const batasKloter = Number(kloterMaks);

  if (pertama === null || terakhir === null) {
    throw new Error("Waktu keberangkatan belum lengkap.");
  }
  if (terakhir <= pertama) {
    throw new Error("Waktu berangkat terakhir harus setelah waktu pertama.");
  }
  if (!Number.isInteger(eksternal) || eksternal < 0 ||
      !Number.isInteger(intern) || intern < 0 || eksternal + intern < 1) {
    throw new Error("Jumlah regu minimal 1.");
  }
  if (!Number.isInteger(kapasitasEksternal) || kapasitasEksternal < 1 ||
      !Number.isInteger(kapasitasIntern) || kapasitasIntern < 1) {
    throw new Error("Kapasitas kloter belum dikonfigurasi.");
  }
  if (!Number.isInteger(batasKloter) || batasKloter < 1) {
    throw new Error("Batas jumlah kloter belum dikonfigurasi.");
  }

  const jumlahKloter = Math.max(
    Math.ceil(eksternal / kapasitasEksternal),
    Math.ceil(intern / kapasitasIntern),
  );
  if (jumlahKloter > batasKloter) {
    throw new Error(
      `${eksternal + intern} regu membutuhkan ${jumlahKloter} kloter, melebihi batas ${batasKloter}.`
    );
  }

  /* PEMBAGINYA `batasKloter`, BUKAN `jumlahKloter`, dan itu bukan pilihan
     gaya — ia menyamakan kalkulator ini dengan `perkiraan_berangkat_kloter()`
     di database (migrasi 0105).

     Database menyebar seluruh kloter edisi, termasuk cadangan, supaya kloter
     ke-61 dan seterusnya tetap punya perkiraan DI DALAM jendela 07:00-10:00
     (CLAUDE.md 10.1: yang terakhir sudah berangkat pukul sepuluh). Membagi
     dengan jumlah yang dibutuhkan saja membuat cadangan yang benar-benar
     terpakai berangkat sesudah pukul sepuluh.

     Angka databaselah yang tercetak di kertas kloter yang dibagikan ke peserta
     dan yang muncul sebagai `~HH:MM` di chip layar Keberangkatan. Kalkulator
     ini dipakai menyusun jadwal pagi. Dengan dua pembagi, keduanya menyebut
     jam berbeda untuk kloter yang sama: pada 60 kloter dan batas 75, K60
     terbaca 10:00 di sini dan 09:23 di sana — selisih 37 menit.

     BARISNYA tetap sebanyak kloter yang dibutuhkan: yang direncanakan cuma
     kloter yang benar-benar diisi.

     `floor`, bukan `round`: database mengembalikan timestamptz berdetik dan
     layar menampilkannya lewat jamMenit(), yang MEMOTONG detik. K10 di sana
     07:21:53 terbaca "07:21"; membulatkan di sini akan menuliskannya 07:22. */
  const rentang = terakhir - pertama;
  return Array.from({ length: jumlahKloter }, (_, indeks) => {
    const waktu = batasKloter === 1
      ? pertama
      : pertama + Math.floor(rentang * indeks / (batasKloter - 1));
    return {
      kloter: indeks + 1,
      jumlahEksternal: Math.max(0, Math.min(kapasitasEksternal,
        eksternal - indeks * kapasitasEksternal)),
      jumlahIntern: Math.max(0, Math.min(kapasitasIntern,
        intern - indeks * kapasitasIntern)),
      waktuBerangkat: jamDariMenit(waktu),
    };
  });
}
