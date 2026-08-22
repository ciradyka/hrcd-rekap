/* ============================================================================
   Kalkulator pembagian kloter dan waktu keberangkatan.

   Murni perhitungan: tidak membaca DOM dan tidak menyimpan ke database. Karena
   itu rumus yang sama bisa diuji di Node dan dipakai layar Pengaturan Kloter.
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
 * Isi kloter paling awal sampai kapasitas, lalu sebarkan jam K1 sampai kloter
 * terakhir merata di seluruh jendela. Baris terakhir selalu memakai waktu
 * terakhir persis; pembulatan hanya memengaruhi kloter di antaranya.
 */
export function hitungRekomendasiKloter({
  waktuPertama,
  waktuTerakhir,
  jumlahRegu,
  maksReguPerKloter,
  kloterMaks,
}) {
  const pertama = menitDariJam(waktuPertama);
  const terakhir = menitDariJam(waktuTerakhir);
  const regu = Number(jumlahRegu);
  const kapasitas = Number(maksReguPerKloter);
  const batasKloter = Number(kloterMaks);

  if (pertama === null || terakhir === null) {
    throw new Error("Waktu keberangkatan belum lengkap.");
  }
  if (terakhir <= pertama) {
    throw new Error("Waktu berangkat terakhir harus setelah waktu pertama.");
  }
  if (!Number.isInteger(regu) || regu < 1) {
    throw new Error("Jumlah regu minimal 1.");
  }
  if (!Number.isInteger(kapasitas) || kapasitas < 1) {
    throw new Error("Kapasitas kloter belum dikonfigurasi.");
  }
  if (!Number.isInteger(batasKloter) || batasKloter < 1) {
    throw new Error("Batas jumlah kloter belum dikonfigurasi.");
  }

  const jumlahKloter = Math.ceil(regu / kapasitas);
  if (jumlahKloter > batasKloter) {
    throw new Error(
      `${regu} regu membutuhkan ${jumlahKloter} kloter, melebihi batas ${batasKloter}.`
    );
  }

  const rentang = terakhir - pertama;
  return Array.from({ length: jumlahKloter }, (_, indeks) => {
    const waktu = jumlahKloter === 1
      ? pertama
      : pertama + Math.round(rentang * indeks / (jumlahKloter - 1));
    return {
      kloter: indeks + 1,
      jumlahRegu: Math.min(kapasitas, regu - indeks * kapasitas),
      waktuBerangkat: jamDariMenit(waktu),
    };
  });
}
